import os
import re
import zipfile
import requests

# --- CONFIGURATION ---
API_KEY = "fc-53263c21cf1a410aadfbbab2b561e940"
JOB_ID = "019f0461-c25a-76c9-b2fd-6d59fe22df96"
ZIP_FILENAME = "mantra_tech_markdown.zip"
# ---------------------


def clean_filename(url):
    # Turn a URL path into a clean file name
    path = url.split("://")[-1].replace("www.", "")
    clean = re.sub(r"[^a-zA-Z0-9_\-\/]", "_", path)
    clean = clean.strip("/").replace("/", "_")
    return f"{clean or 'index'}.md"


def download_crawl_to_zip():
    url = f"https://api.firecrawl.dev/v2/crawl/{JOB_ID}"
    headers = {"Authorization": f"Bearer {API_KEY}"}

    print("Fetching partial crawl data...")

    with zipfile.ZipFile(ZIP_FILENAME, "w", zipfile.ZIP_DEFLATED) as zipf:
        page_count = 0

        while url:
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"Error fetching data: {response.text}")
                break

            res_data = response.json()
            pages = res_data.get("data", [])

            for page in pages:
                page_url = page.get("metadata", {}).get("url", "unknown_url")
                markdown_content = page.get("markdown", "")

                if markdown_content:
                    filename = clean_filename(page_url)
                    # Write directly into the zip archive
                    zipf.writestr(filename, markdown_content)
                    page_count += 1

            # Check if there are more pages available via pagination
            url = res_data.get("next")

        print(
            f"Successfully zipped {page_count} markdown files into '{ZIP_FILENAME}'!"
        )


if __name__ == "__main__":
    download_crawl_to_zip()