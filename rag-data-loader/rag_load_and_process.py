import os
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, UnstructuredPDFLoader
from langchain_community.vectorstores import Pinecone
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
# Load environment variables
load_dotenv()

import sys
print(f"Script Python Path: {sys.executable}")

# Check if the key is loaded
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    print("OpenAI API Key loaded successfully.")
else:
    print("Failed to load OpenAI API Key.")

# Create Pinecone client
pc = Pinecone(
    api_key=os.getenv("PINECONE_API_KEY")
    
)
print(os.getenv("PINECONE_API_KEY"))

# Define Pinecone index
index_name = "collectiondb"
if index_name not in pc.list_indexes().names():
    pc.create_index(
        name=index_name,
        dimension=1536,  # Dimension for 'text-embedding-ada-002'
        metric="cosine",
        spec=ServerlessSpec(
            cloud="aws",  # Replace with your cloud provider if different
            region=os.getenv("PINECONE_ENVIRONMENT")  # Your Pinecone environment (e.g., 'us-west-2')
        )
    )

# Load documents
loader = DirectoryLoader(
    os.path.abspath("./pdf-documents"),
    glob="**/*.pdf",
    use_multithreading=True,
    show_progress=True,
    max_concurrency=50,
    loader_cls=UnstructuredPDFLoader,
)
docs = loader.load()

# Create embeddings
embeddings = OpenAIEmbeddings(model='text-embedding-ada-002')

# Split documents into chunks
text_splitter=RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
# flattened_docs = [doc[0] for doc in docs if doc]
# flattened_docs = [doc.page_content for doc in docs if doc.page_content]
chunks = text_splitter.split_documents(docs)

# Store documents in Pinecone using langchain_community.vectorstores
vectorstore = PineconeVectorStore.from_documents(
    documents=chunks,
    embedding=embeddings,
    index_name=index_name
)

print("Documents successfully indexed in Pinecone!")
