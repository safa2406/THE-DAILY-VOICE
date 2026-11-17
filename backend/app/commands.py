import click
from flask import Flask
from app.services.newspaper_importer import import_all_sample_newspapers

def register_commands(app: Flask):
    """Registers custom Flask CLI commands."""

    @app.cli.command("import-newspapers")
    def import_newspapers_command():
        """Import the six sample newspaper broadsheets into the database."""
        click.echo("Starting newspaper import from sample_newspapers/...")
        summary = import_all_sample_newspapers()
        click.echo("\n--- Newspaper Import Summary ---")
        click.echo(f"Editions processed: {summary['total_editions_processed']}")
        click.echo(f"Editions inserted:  {summary['editions_inserted']}")
        click.echo(f"Editions updated:   {summary['editions_updated']}")
        click.echo(f"Editions failed:    {summary['editions_failed']}")
        click.echo(f"Articles inserted:  {summary['articles_inserted']}")
        click.echo(f"Articles updated:   {summary['articles_updated']}")
        click.echo(f"Articles skipped:   {summary['articles_skipped']}")
        click.echo(f"Total extracted:    {summary['total_articles_extracted']}")

        for res in summary["results"]:
            status = res["status"].upper()
            paper = res["newspaper"]
            code = res["edition_code"]
            total_art = res.get("total_articles", 0)
            click.echo(f"  [{status}] {paper} ({code}) - {total_art} articles")
