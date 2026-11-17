import io
import os
from unittest.mock import patch
import pytest
import pymupdf
import numpy as np
import cv2
import pytesseract

from app.models.base import db
from app.models.edition import Edition
from app.models.article import Article, VALID_CATEGORIES
from app.services.pdf_extractor import (
    get_tesseract_cmd,
    check_tesseract_installed,
    ensure_tesseract_available,
    preprocess_page_image_for_ocr,
    ocr_page,
    parse_articles_from_page_text,
    extract_articles_from_pdf,
    extract_metadata_from_pdf,
)


def get_sample_path(rel_path: str) -> str:
    """Finds absolute path to a sample PDF."""
    candidates = [
        rel_path,
        os.path.join(os.getcwd(), rel_path),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", rel_path)),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError(f"Sample PDF not found at {rel_path}")


def create_synthetic_scanned_pdf_bytes(base_pdf_rel_path: str = "sample_newspapers/NoQR/ED001_The_Gazette.pdf") -> bytes:
    """
    Renders the first page of a real newspaper broadsheet into a pure raster image
    and embeds it into a new PDF with zero digital text layer (genuine scanned PDF).
    """
    sample_path = get_sample_path(base_pdf_rel_path)
    doc = pymupdf.open(sample_path)
    pix = doc[0].get_pixmap(dpi=100)
    img_bytes = pix.tobytes("png")
    doc.close()

    new_doc = pymupdf.open()
    page = new_doc.new_page(width=pix.width, height=pix.height)
    page.insert_image(page.rect, stream=img_bytes)
    pdf_bytes = new_doc.tobytes()
    new_doc.close()
    return pdf_bytes


# Realistic sample OCR text containing masthead, articles, codes, and paragraphs
MOCK_OCR_PAGE_1_TEXT = """
THE GAZETTE
The Modern Broadcaster • Accurate, Comprehensive & Reliable
ED001 • NOVEMBER 7, 2026 • EASTERN BROADSHEET • 5 PAGES • PRICE $2.50
KOLKATA 29°C FAIR • BHUBANESWAR 31°C WARM • PARIS 14°C CRISP • TOKYO 18°C SUNNY

NATIONAL AFFAIRS TG-CA-001
New National Semiconductor Research Facility Inaugurated in Kolkata
By Ananya Roy in Kolkata
The Union Minister of Electronics and Information Technology on Saturday inaugurated the state-of-the-art National Semiconductor Research Centre in Kolkata.
The five-hundred-crore initiative aims to accelerate domestic chip design and advance packaging technologies across Eastern India.
Delegates from leading academic institutions and semiconductor consortia toured the cleanrooms and testing laboratories.

CAPITOL HILL TG-CA-002
US Congress Approves Comprehensive Bilateral Framework on Artificial Intelligence Safety
By Michael Reynolds in Washington
In a landmark bipartisan vote, both houses of the United States Congress approved legislation establishing rigorous safety standards for frontier artificial intelligence models.
The bill mandates independent security audits and clear reporting requirements for AI developers operating within federal infrastructure.
Legislators praised the measure as a critical milestone in balanced technology governance.

GLOBAL DIPLOMACY TG-WN-001
South Asian Maritime Security Coalition Signs Joint Environmental Protection Pact
By Devika Menon in Singapore
Senior naval commanders and environmental ministers from eight nations signed the Bay of Bengal Ocean Conservation Protocol on Friday.
The agreement coordinates joint patrols targeting illegal industrial waste dumping and marine habitat degradation.
Participating delegates emphasized the treaty represents a major step forward for regional ecological security.
"""


def test_tesseract_detection_and_missing_error():
    """Verifies Tesseract detection functions and actionable error when binary is absent."""
    with patch("app.services.pdf_extractor.get_tesseract_cmd", return_value=None):
        assert check_tesseract_installed() is False
        with pytest.raises(pytesseract.TesseractNotFoundError) as exc_info:
            ensure_tesseract_available()
        assert "Tesseract OCR engine is not installed or configured" in str(exc_info.value)
        assert "winget install UB-Mannheim.TesseractOCR" in str(exc_info.value)

    # When get_tesseract_cmd returns a mock executable path
    with patch("app.services.pdf_extractor.get_tesseract_cmd", return_value="/mock/bin/tesseract"):
        with patch("pytesseract.get_tesseract_version", return_value="5.3.0"):
            assert check_tesseract_installed() is True
            assert ensure_tesseract_available() == "/mock/bin/tesseract"


def test_opencv_preprocessing_pipeline():
    """Tests OpenCV preprocessing with Otsu binarization and Adaptive Gaussian thresholding."""
    # Create synthetic test image (200x200 BGR)
    bgr_img = np.full((200, 200, 3), 240, dtype=np.uint8)
    # Add dark text-like strokes
    cv2.putText(bgr_img, "THE DAILY VOICE", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)

    # Test Otsu thresholding
    otsu_res = preprocess_page_image_for_ocr(bgr_img, method="otsu")
    assert otsu_res.shape == (200, 200)
    assert otsu_res.dtype == np.uint8
    # Binary image should only contain 0 and 255
    unique_vals = set(np.unique(otsu_res))
    assert unique_vals.issubset({0, 255})

    # Test Adaptive thresholding
    adaptive_res = preprocess_page_image_for_ocr(bgr_img, method="adaptive")
    assert adaptive_res.shape == (200, 200)
    assert adaptive_res.dtype == np.uint8

    # Test single-channel grayscale input
    gray_input = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    gray_res = preprocess_page_image_for_ocr(gray_input)
    assert gray_res.shape == (200, 200)


def test_parse_articles_from_page_text_ocr_variations():
    """Tests article parsing from text with OCR variations in codes, bylines, and categories."""
    raw_ocr = """
GLOBAL REPORT TG–WN–001
International Climate Accord Ratified By Forty Nations
By: Sarah Jenkins in Geneva
elegates from forty countries formalized the agreement at the United Nations headquarters on Friday afternoon.
The treaty outlines ambitious targets for emission reduction and establishes a transition fund for developing nations.

TECH ADVANCES TG - ST - 002
Quantum Computing Breakthrough Achieved at National Lab
BY DR. ALAN TURING IN CAMBRIDGE
hysicists have demonstrated continuous fault-tolerant quantum error correction for over two hours.
The breakthrough paves the way for scalable quantum computing systems.

CAPITOL UPDATE TG-CA-002
US Congress Approves Comprehensive Bilateral Framework on Artificial Intelligence Safety
By Michael Reynolds in Washington
In a landmark bipartisan vote, legislators enacted new oversight laws.
"""
    articles = parse_articles_from_page_text(raw_ocr, page_num=1)
    assert len(articles) == 3

    # Check first article (World category, normalized en-dash code, drop-cap replacement)
    art1 = articles[0]
    assert art1["code"] == "TG-WN-001"
    assert art1["category"] == "World"
    assert art1["headline"] == "International Climate Accord Ratified By Forty Nations"
    assert "Delegates" in art1["content"]  # 'elegates' replaced by 'Delegates'
    assert art1["duration_seconds"] >= 45

    # Check second article (Science & Technology category, space-normalized code)
    art2 = articles[1]
    assert art2["code"] == "TG-ST-002"
    assert art2["category"] == "Science & Technology"
    assert "Physicists" in art2["content"]  # 'hysicists' replaced by 'Physicists'

    # Check third article (classified as Politics based on Congress / legislation subject matter)
    art3 = articles[2]
    assert art3["code"] == "TG-CA-002"
    assert art3["category"] == "Politics"


def test_scanned_pdf_upload_when_tesseract_missing_returns_422(client):
    """Uploading a scanned PDF when Tesseract OCR is not installed returns HTTP 422 with actionable guidance."""
    scanned_pdf_bytes = create_synthetic_scanned_pdf_bytes()

    with patch("app.routes.editions.check_tesseract_installed", return_value=False):
        res = client.post(
            "/api/editions/upload",
            data={"file": (io.BytesIO(scanned_pdf_bytes), "scanned_issue.pdf")},
        )

        assert res.status_code == 422
        assert res.json["status"] == "error"
        assert "Tesseract OCR engine is not installed or configured" in res.json["message"]
        assert "Please install Tesseract-OCR" in res.json["message"]


def test_scanned_pdf_upload_success_with_mocked_tesseract(client, app):
    """Uploading a scanned PDF with OCR successfully parses articles and stores them in the database."""
    scanned_pdf_bytes = create_synthetic_scanned_pdf_bytes()

    with patch("app.routes.editions.check_tesseract_installed", return_value=True):
        with patch("app.services.pdf_extractor.check_tesseract_installed", return_value=True):
            with patch("app.services.pdf_extractor.ensure_tesseract_available", return_value="/mock/bin/tesseract"):
                with patch("pytesseract.image_to_string", return_value=MOCK_OCR_PAGE_1_TEXT):
                    res = client.post(
                        "/api/editions/upload",
                        data={"file": (io.BytesIO(scanned_pdf_bytes), "ED001_Scanned_Gazette.pdf")},
                    )

                    assert res.status_code == 200
                    assert res.json["status"] == "success"

                    data = res.json["data"]
                    assert data["newspaper_name"] == "The Gazette"
                    assert data["edition_code"] == "ED001"
                    assert len(data["articles"]) == 3

                    # Verify categories and codes
                    codes = [a["article_code"] for a in data["articles"]]
                    assert "TG-CA-001" in codes
                    assert "TG-CA-002" in codes
                    assert "TG-WN-001" in codes

                    # TG-CA-002 classified under Politics
                    politics_art = next(a for a in data["articles"] if a["article_code"] == "TG-CA-002")
                    assert politics_art["category"] == "Politics"

                    # Verify persistence in database
                    with app.app_context():
                        ed = db.session.query(Edition).filter_by(newspaper_name="The Gazette").first()
                        assert ed is not None
                        assert len(ed.articles) == 3


def test_scanned_pdf_unreadable_text_returns_422(client):
    """Scanned PDF where OCR yields no valid articles returns HTTP 422 with clear rejection."""
    scanned_pdf_bytes = create_synthetic_scanned_pdf_bytes()

    # OCR text returns blurry unreadable noise with no newspaper article structures
    noise_ocr = "XYZ 123456789 BLURRY UNREADABLE ARTIFACTS ONLY !!! @@@ ###"

    with patch("app.routes.editions.check_tesseract_installed", return_value=True):
        with patch("app.services.pdf_extractor.check_tesseract_installed", return_value=True):
            with patch("app.services.pdf_extractor.ensure_tesseract_available", return_value="/mock/bin/tesseract"):
                with patch("pytesseract.image_to_string", return_value=noise_ocr):
                    res = client.post(
                        "/api/editions/upload",
                        data={"file": (io.BytesIO(scanned_pdf_bytes), "unreadable_scan.pdf")},
                    )

                    assert res.status_code == 422
                    assert res.json["status"] == "error"
                    assert "No individual articles could be extracted" in res.json["message"]


def test_text_pdf_bypasses_ocr(client):
    """Text-based broadsheet PDF does not invoke OCR and relies exclusively on standard PyPDF extraction."""
    gazette_path = get_sample_path("sample_newspapers/NoQR/ED001_The_Gazette.pdf")
    with open(gazette_path, "rb") as f:
        pdf_bytes = f.read()

    with patch("app.services.pdf_extractor.ocr_page") as mock_ocr:
        res = client.post(
            "/api/editions/upload",
            data={"file": (io.BytesIO(pdf_bytes), "ED001_The_Gazette.pdf")},
        )

        assert res.status_code == 200
        assert res.json["status"] == "success"
        assert res.json["data"]["article_count"] == 20
        # OCR page must never be called for digital text PDFs
        mock_ocr.assert_not_called()
