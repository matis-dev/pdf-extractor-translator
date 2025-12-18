import importlib
print("Checking langchain.chains...")
try:
    m = importlib.import_module("langchain.chains")
    print("langchain.chains found!")
    if hasattr(m, "RetrievalQA"):
        print("RetrievalQA found in langchain.chains")
    else:
        print("RetrievalQA NOT found in langchain.chains")
except ImportError as e:
    print(f"ImportError: {e}")

print("Checking langchain top level...")
import langchain
print(f"Version: {langchain.__version__}")
if hasattr(langchain, "chains"):
    print("langchain.chains exists in top level")
else:
    print("langchain.chains does NOT exist in top level")
