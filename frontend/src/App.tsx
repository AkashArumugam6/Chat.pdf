import React, { useState } from 'react';
import './App.css';
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { AiOutlineSend, AiOutlineUpload, AiOutlineUser } from "react-icons/ai";
import { ClipLoader } from 'react-spinners';

interface Message {
  message: string;
  isUser: boolean;
  sources?: string[];
}

function App() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [loadingPDFs, setLoadingPDFs] = useState(false);
  const [pdfsProcessed, setPdfsProcessed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [showProcessingPopup, setShowProcessingPopup] = useState(false);


  const setPartialMessage = (chunk: string, sources: string[] = []) => {
    setMessages(prevMessages => {
      let lastMessage = prevMessages[prevMessages.length - 1];
      if (prevMessages.length === 0 || !lastMessage.isUser) {
        return [...prevMessages.slice(0, -1), {
          message: lastMessage.message + chunk,
          isUser: false,
          sources: lastMessage.sources ? [...lastMessage.sources, ...sources] : sources
        }];
      }

      return [...prevMessages, { message: chunk, isUser: false, sources }];
    });
  };

  function handleReceiveMessage(data: string) {
    let parsedData = JSON.parse(data);

    if (parsedData.answer) {
      setPartialMessage(parsedData.answer.content);
    }

    if (parsedData.docs) {
      setPartialMessage("", parsedData.docs.map((doc: any) => doc.metadata.source));
    }
  }

  const handleSendMessage = async (message: string) => {
    setInputValue("");
    setMessages(prevMessages => [...prevMessages, { message, isUser: true }]);
    setLoading(true);

    await fetchEventSource(`http://localhost:8000/rag/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          question: message,
        }
      }),
      onmessage(event) {
        if (event.event === "data") {
          handleReceiveMessage(event.data);
        }
      },
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      handleSendMessage(inputValue.trim());
    }
  };

  function formatSource(source: string) {
    return source.split("/").pop() || "";
  }

  const handleUploadFiles = async () => {
    if (!selectedFiles) return;

    setUploading(true);
    const formData = new FormData();
    Array.from(selectedFiles).forEach((file: Blob) => formData.append('files', file));

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        console.log('Upload successful');
        setIsUploaded(true);
      } else {
        console.error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }

    setTimeout(() => {
      setUploading(false);
      setFileName(null); // Hide file name after upload
      setShowUploadPopup(true);
    }, 3000); // Keep spinner for 3 seconds
  };

  const loadAndProcessPDFs = async () => {
    setLoadingPDFs(true);

    try {
      const response = await fetch('http://localhost:8000/load-and-process-pdfs', {
        method: 'POST',
      });

      if (response.ok) {
        console.log('PDFs loaded and processed successfully');
      } else {
        console.error('Failed to load and process PDFs');
      }
    } catch (error) {
      console.error('Error:', error);
    }

    setTimeout(() => {
      setLoadingPDFs(false);
      setIsUploaded(false);
      setPdfsProcessed(true);
      setShowProcessingPopup(true);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col font-mono">
      <header className="bg-neutral-800 text-white text-center py-6 shadow-md text-2xl font-bold">
        Chat.pdf
      </header>
      <main className="flex-grow container mx-auto p-4 flex flex-col justify-between">
        <div className="flex-grow bg-neutral-800 shadow rounded-lg overflow-hidden p-4 space-y-4 flex flex-col">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-4 my-2 rounded-lg max-w-lg ${msg.isUser ? "self-end bg-neutral-700 text-right" : "self-start bg-neutral-600 text-left"
                }`}
            >
              {msg.message}
            </div>
          ))}
        </div>

        <div className="bg-neutral-900 border-t my-3 border-neutral-700 p-7">
          <div className="flex items-center space-x-4">
            <textarea
              className="form-textarea w-full p-3 bg-neutral-900 text-neutral-100 rounded-md border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Type your question..."
              onKeyUp={handleKeyPress}
              onChange={(e) => setInputValue(e.target.value)}
              value={inputValue}
            />
            <AiOutlineSend
              className="text-white cursor-pointer text-3xl hover:text-neutral-400"
              onClick={() => handleSendMessage(inputValue.trim())}
            />
          </div>

          <div className="mt-4 flex items-center space-x-4">
            <button
              className="text-neutral-400 hover:text-white p-2"
              onClick={() => {
                const fileInput = document.getElementById("fileInput");
                if (fileInput) {
                  fileInput.click();
                }
              }}
            >
              <AiOutlineUpload className="text-2xl" />
            </button>
            <input
              id="fileInput"
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                setSelectedFiles(e.target.files);
                if (e.target.files) {
                  setFileName(Array.from(e.target.files).map(file => file.name).join(", "));
                }
              }}
            />
            {fileName && (
              <div className="text-neutral-400 text-sm mx-4">{fileName}</div>
            )}
            <button
              className="bg-neutral-700 hover:bg-neutral-600 text-neutral-200 font-semibold py-2 px-4 rounded-md shadow-md"
              onClick={handleUploadFiles}
            >
              {uploading ? <ClipLoader color="#ffffff" size={20} /> : "Upload"}
            </button>
            <button
              className={`ml-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 font-semibold py-2 px-4 rounded-md shadow-md ${!isUploaded ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={loadAndProcessPDFs}
              disabled={pdfsProcessed || !isUploaded}
            >
              {loadingPDFs ? <ClipLoader color="#ffffff" size={20} /> : "Load and Process"}
            </button>
          </div>
        </div>
      </main>
      <footer className="bg-neutral-800 text-neutral-400 text-center py-4 text-sm border-t border-neutral-700">
        Copyright © 2024 Akash Arumugam Venkatachalapathy
      </footer>

      {showUploadPopup && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-4 rounded-md shadow-md">
          Upload successful!
          <button
            onClick={() => setShowUploadPopup(false)}
            className="ml-2 text-black bg-white rounded-full px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>
      )}
      {showProcessingPopup && (
        <div className="absolute top-40 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white p-4 rounded-md shadow-md">
          PDFs loaded and processed successfully!
          <button
            onClick={() => setShowProcessingPopup(false)}
            className="ml-2 text-black bg-white rounded-full px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
