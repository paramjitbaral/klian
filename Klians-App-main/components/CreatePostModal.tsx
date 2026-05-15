import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { ICONS } from '../constants';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../src/utils/imageCrop';

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onPost: (content: string, image?: string, fileName?: string) => void;
    initialFile?: File | null;
    initialType?: 'image' | 'video' | 'document' | null;
}

const IconButton: React.FC<{ title: string; children: React.ReactNode; onClick?: () => void; onMouseDown?: (e: React.MouseEvent) => void; isActive?: boolean }> = ({ title, children, onClick, onMouseDown, isActive }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        onMouseDown={onMouseDown}
        className={`p-2 rounded-xl transition-all ${isActive ? 'text-red-600' : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
        {children}
    </button>
);

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, user, onPost, initialFile, initialType }) => {
    const [image, setImage] = useState<string>('');
    const [imagePreview, setImagePreview] = useState<string>('');
    const [selectedDocument, setSelectedDocument] = useState<{ name: string; data: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isToolsExpanded, setIsToolsExpanded] = useState(false);
    
    // Image Editing State
    const [isEditingImage, setIsEditingImage] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const textareaRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);

    const processImage = (file: File) => {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a PNG or JPG image');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            return;
        }

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64String = e.target?.result as string;
            setImagePreview(base64String);
            setIsEditingImage(true); // Open editor
            setIsLoading(false);
        };
        reader.onerror = () => setIsLoading(false);
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const finalizeImage = async () => {
        if (!imagePreview || !croppedAreaPixels) return;
        setIsLoading(true);
        try {
            const croppedImageBlob = await getCroppedImg(imagePreview, croppedAreaPixels, rotation);
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target?.result as string;
                setImage(base64String);
                setImagePreview(base64String);
                setIsEditingImage(false);
                setIsLoading(false);
            };
            reader.readAsDataURL(croppedImageBlob);
        } catch (e) {
            console.error(e);
            setIsLoading(false);
        }
    };

    const processDocument = (file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            alert('Document must be less than 10MB');
            return;
        }

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64String = e.target?.result as string;
            setSelectedDocument({ name: file.name, data: base64String });
            setIsLoading(false);
        };
        reader.onerror = () => setIsLoading(false);
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialFile && initialType) {
                if (initialType === 'image') processImage(initialFile);
                if (initialType === 'document') processDocument(initialFile);
            } else {
                setImage('');
                setImagePreview('');
                setSelectedDocument(null);
            }
            setIsEditingImage(false);
            setRotation(0);
            setZoom(1);
            setIsToolsExpanded(false);
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isOpen, initialFile, initialType]);

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) processImage(file);
    };

    const handleDocumentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) processDocument(file);
    };

    const handleRemoveImage = () => {
        setImage('');
        setImagePreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveDocument = () => {
        setSelectedDocument(null);
        if (documentInputRef.current) documentInputRef.current.value = '';
    };

    const handlePost = async () => {
        const text = textareaRef.current?.innerText || '';
        // Prioritize image, then document
        const fileData = image || selectedDocument?.data;
        const fileName = selectedDocument?.name;
        
        if (text.trim() || fileData) {
            setIsLoading(true);
            try {
                await onPost(text, fileData || undefined, fileName);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const applyFormat = (command: 'bold' | 'italic') => {
        window.document.execCommand(command, false);
        textareaRef.current?.focus();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border border-slate-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-12">
                        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-slate-900 dark:text-slate-100">
                            {React.cloneElement(ICONS.close, { className: "h-6 w-6" })}
                        </button>
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {isEditingImage ? "Edit Media" : "Create new post"}
                    </h2>
                    <div className="w-12 flex justify-end">
                        {isEditingImage ? (
                            <button
                                onClick={finalizeImage}
                                disabled={isLoading}
                                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-[15px] font-semibold transition-all disabled:opacity-30"
                            >
                                Done
                            </button>
                        ) : (
                            <button
                                onClick={handlePost}
                                disabled={isLoading}
                                className={`text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-[15px] font-semibold transition-all disabled:opacity-30 flex items-center gap-2`}
                            >
                                {isLoading && (
                                    <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                )}
                                Share
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto scrollbar-hide relative min-h-[300px]">
                    {isLoading && !isEditingImage && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] z-[60] flex flex-col items-center justify-center animate-fade-in">
                            <div className="relative h-16 w-16 mb-4">
                                <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {React.cloneElement(ICONS.attachment, { className: "h-6 w-6 text-blue-500 animate-pulse" })}
                                </div>
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide">Sharing to Klias...</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-widest">Please wait</span>
                        </div>
                    )}

                    {isEditingImage && imagePreview ? (
                        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                            <div className="relative flex-1 min-h-[300px]">
                                <Cropper
                                    image={imagePreview}
                                    crop={crop}
                                    zoom={zoom}
                                    rotation={rotation}
                                    aspect={4 / 3}
                                    onCropChange={setCrop}
                                    onCropComplete={handleCropComplete}
                                    onZoomChange={setZoom}
                                />
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zoom</span>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="flex-1 accent-blue-500 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setRotation((r) => (r - 90) % 360)}
                                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-xs font-medium"
                                        >
                                            <div className="rotate-[-90deg]">
                                                {React.cloneElement(ICONS.attachment, { className: "h-4 w-4" })}
                                            </div>
                                            Rotate
                                        </button>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Drag to reposition
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6">
                            <div className="flex gap-4">
                                <Avatar src={user.avatar} alt={user.name} size="md" />
                                <div className="flex-1 min-w-0 relative">
                                    <div
                                        ref={textareaRef}
                                        contentEditable
                                        className="w-full bg-transparent dark:text-slate-100 focus:outline-none min-h-[120px] text-[15px] leading-relaxed cursor-text empty:before:content-[attr(placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 empty:before:pointer-events-none"
                                        placeholder={`Write a caption...`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.ctrlKey) handlePost();
                                        }}
                                    />
                                </div>
                            </div>

                            {imagePreview && (
                                <div className="mt-6 relative group">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full rounded-xl max-h-[250px] object-cover border border-slate-100 dark:border-slate-800"
                                    />
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        <button
                                            onClick={() => setIsEditingImage(true)}
                                            className="bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-1.5 transition-colors"
                                            title="Edit Image"
                                        >
                                            <div className="scale-75">
                                                {React.cloneElement(ICONS.attachment, { className: "h-4 w-4" })}
                                            </div>
                                        </button>
                                        <button
                                            onClick={handleRemoveImage}
                                            className="bg-slate-900/80 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                                        >
                                            {React.cloneElement(ICONS.close, { className: "h-3.5 w-3.5" })}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedDocument && (
                                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                            {React.cloneElement(ICONS.document, { className: "h-6 w-6" })}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{selectedDocument.name}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Document</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleRemoveDocument}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-full transition-all"
                                    >
                                        {React.cloneElement(ICONS.close, { className: "h-4 w-4" })}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                {!isEditingImage && (
                    <footer className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                        <div className="flex items-center justify-between">
                             <div className="flex items-center gap-0.5">
                                 <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleImageSelect} className="hidden" />
                                 <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleDocumentSelect} className="hidden" />

                                 <IconButton
                                    title={isToolsExpanded ? "Close" : "Add to your post"}
                                    onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                                 >
                                    <div className={`transition-all duration-300 ${isToolsExpanded ? 'rotate-0 text-red-500' : '-rotate-45'}`}>
                                        {React.cloneElement(ICONS.attachment, { className: "h-6 w-6" })}
                                    </div>
                                 </IconButton>

                                 <div className={`flex items-center gap-0.5 overflow-hidden transition-all duration-500 ${isToolsExpanded ? 'max-w-xs opacity-100' : 'max-w-0 opacity-0 pointer-events-none'}`}>
                                    <IconButton title="Photo" onClick={() => fileInputRef.current?.click()} isActive={!!image}>
                                        {React.cloneElement(ICONS.media, { className: "h-5 w-5" })}
                                    </IconButton>
                                    <IconButton title="Video">{React.cloneElement(ICONS.video, { className: "h-5 w-5" })}</IconButton>
                                    <IconButton title="Document" onClick={() => documentInputRef.current?.click()} isActive={!!selectedDocument}>
                                        {React.cloneElement(ICONS.document, { className: "h-5 w-5" })}
                                    </IconButton>
                                 </div>
                             </div>

                             <div className="flex items-center gap-1">
                                <button
                                    onClick={() => applyFormat('bold')}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="w-9 h-9 flex items-center justify-center text-[17px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                >
                                    B
                                </button>
                                <button
                                    onClick={() => applyFormat('italic')}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="w-9 h-9 flex items-center justify-center text-[18px] italic font-serif text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                >
                                    I
                                </button>
                             </div>
                        </div>
                    </footer>
                )}
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }

                @keyframes slide-up {
                    from { transform: translateY(15px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};
