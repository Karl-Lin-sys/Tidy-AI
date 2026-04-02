import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import { UploadCloud, Send, Loader2, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react';
import { cn } from './lib/utils';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Image = e.target?.result as string;
      setImage(base64Image);
      
      // Start initial analysis
      await analyzeRoom(base64Image);
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
  });

  const analyzeRoom = async (base64Image: string) => {
    setIsLoading(true);
    setMessages([]); // Clear previous messages

    try {
      // Extract base64 data without the data:image/... prefix
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const textPart = {
        text: "Please analyze this room. Identify areas that need decluttering or organization, and provide 3-5 actionable, step-by-step suggestions to improve the space. Be encouraging and practical.",
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction: "You are a professional home organizer and interior design consultant. You help people declutter, organize, and beautify their spaces. You are supportive, practical, and have a keen eye for spatial arrangement and storage solutions.",
        }
      });

      if (response.text) {
        setMessages([
          {
            id: Date.now().toString(),
            role: 'model',
            text: response.text,
          }
        ]);
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      setMessages([
        {
          id: Date.now().toString(),
          role: 'model',
          text: "I'm sorry, I encountered an error while analyzing the image. Please try uploading it again.",
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Construct history for the API
      // We need to include the image in the first user message
      const base64Data = image?.split(',')[1];
      const mimeType = image?.split(';')[0].split(':')[1];

      // Reconstruct the full conversation
      const fullContents: any[] = [];
      
      if (image && base64Data && mimeType) {
        // Add the initial user prompt with image
        fullContents.push({
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              }
            },
            {
              text: "Please analyze this room. Identify areas that need decluttering or organization, and provide 3-5 actionable, step-by-step suggestions to improve the space. Be encouraging and practical."
            }
          ]
        });
      }

      // Add the rest of the messages
      messages.forEach(msg => {
        fullContents.push({
          role: msg.role,
          parts: [{ text: msg.text }]
        });
      });

      // Add the new user message
      fullContents.push({
        role: 'user',
        parts: [{ text: userMessage.text }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: fullContents,
        config: {
          systemInstruction: "You are a professional home organizer and interior design consultant. You help people declutter, organize, and beautify their spaces. You are supportive, practical, and have a keen eye for spatial arrangement and storage solutions.",
        }
      });

      if (response.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            text: response.text,
          }
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: "I'm sorry, I encountered an error while processing your message. Please try again.",
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetApp = () => {
    setImage(null);
    setMessages([]);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-indigo-600">
          <Sparkles className="w-6 h-6" />
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Tidy AI</h1>
        </div>
        {image && (
          <button
            onClick={resetApp}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Start Over
          </button>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 h-[calc(100vh-73px)]">
        
        {/* Left Column: Image Upload & Preview */}
        <div className={cn(
          "flex flex-col transition-all duration-500 ease-in-out",
          image ? "lg:w-1/3 h-64 lg:h-full" : "w-full h-full max-w-2xl mx-auto justify-center"
        )}>
          {!image ? (
            <div className="flex flex-col items-center justify-center h-full space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
                  Transform your space.
                </h2>
                <p className="text-lg text-neutral-600 max-w-xl mx-auto">
                  Upload a photo of any messy room, and our AI organizer will give you a step-by-step plan to declutter and beautify it.
                </p>
              </div>

              <div
                {...getRootProps()}
                className={cn(
                  "w-full max-w-xl p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4 bg-white",
                  isDragActive ? "border-indigo-500 bg-indigo-50/50" : "border-neutral-300 hover:border-indigo-400 hover:bg-neutral-50"
                )}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-neutral-900">
                    {isDragActive ? "Drop your photo here" : "Click or drag a photo"}
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Supports JPG, PNG, WEBP
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 shadow-sm flex-shrink-0">
              <img
                src={image}
                alt="Uploaded room"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-white">
                <ImageIcon className="w-5 h-5" />
                <span className="text-sm font-medium drop-shadow-md">Room Analysis Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Chat Interface */}
        {image && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden h-full">
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {messages.length === 0 && isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="animate-pulse">Analyzing your space and preparing suggestions...</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex w-full",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-5 py-4",
                      msg.role === 'user'
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-neutral-100 text-neutral-900 rounded-tl-sm"
                    )}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="prose prose-sm md:prose-base prose-neutral max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && messages.length > 0 && (
                <div className="flex justify-start w-full">
                  <div className="bg-neutral-100 text-neutral-900 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                    <span className="text-sm text-neutral-500">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-neutral-100">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-full px-2 py-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about specific items, storage ideas, or next steps..."
                  className="flex-1 bg-transparent border-none focus:outline-none px-4 py-2 text-neutral-900 placeholder:text-neutral-400"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-full p-2.5 transition-colors flex items-center justify-center"
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
