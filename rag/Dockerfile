# RAG sidecar. Build from the repo root:  docker build -f rag/Dockerfile -t arthamind-rag .
FROM python:3.11-slim
WORKDIR /app
COPY rag/requirements.txt rag/requirements.txt
RUN pip install --no-cache-dir -r rag/requirements.txt
# For real models add: RUN pip install --no-cache-dir sentence-transformers "psycopg[binary]"
COPY rag rag
ENV RAG_PORT=8765 RAG_EMBEDDER=hashing
EXPOSE 8765
USER nobody
CMD ["python", "-m", "rag.server"]
