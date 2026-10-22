import requests
from elasticsearch import Elasticsearch

ES_URL = "http://localhost:9200"
INDEX = "drug_enforcement"
PAGE_SIZE = 100
PAGES = 3
MAPPED_FIELDS = (
    "recall_number",
    "event_id",
    "status",
    "classification",
    "product_type",
    "voluntary_mandated",
    "recalling_firm",
    "city",
    "state",
    "country",
    "report_date",
    "recall_initiation_date",
    "product_description",
    "reason_for_recall",
    "code_info",
    "distribution_pattern",
    "product_quantity",
)

es = Elasticsearch(hosts=[ES_URL])


def main():
    documents = load_pages()
    saved = save_documents(documents)
    print(f"sent={len(documents)} saved={saved}")


def load_pages():
    documents = []
    for page in range(PAGES):
        documents.extend(clean_page(fetch_page(page * PAGE_SIZE)))
    return documents


def fetch_page(skip):
    url = f"https://api.fda.gov/drug/enforcement.json?limit={PAGE_SIZE}&skip={skip}"
    response = requests.get(url, timeout=30)
    return response.json()["results"]


def clean_page(rows):
    documents = []
    for row in rows:
        document = clean_document(row)
        if document.get("recall_number"):
            documents.append(document)
    return documents


def clean_document(row):
    document = {}
    for field in MAPPED_FIELDS:
        value = row.get(field)
        if value is None or value == "":
            continue
        document[field] = value
    return document


def save_documents(documents):
    saved = 0
    for document in documents:
        es.index(index=INDEX, id=document["recall_number"], document=document)
        saved += 1
    return saved


if __name__ == "__main__":
    main()
