import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../src/utils/imageCrop';

interface Props {
    image: string;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
    circular?: boolean;
}

export const ImageCropperModal: React.FC<Props> = ({ image, onCropComplete, onCancel, circular = true }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropChange = (crop: any) => setCrop(crop);
    const onZoomChange = (zoom: any) => setZoom(zoom);
    const onRotationChange = (rotation: any) => setRotation(rotation);

    const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleConfirm = async () => {
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-lg aspect-square bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={1}
                    cropShape={circular ? 'round' : 'rect'}
                    showGrid={false}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteInternal}
                    onZoomChange={onZoomChange}
                    onRotationChange={onRotationChange}
                />
            </div>

            <div className="w-full max-w-lg mt-6 space-y-6 px-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>Zoom</span>
                        <span>{Math.round(zoom * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>Rotate</span>
                        <span>{rotation}°</span>
                    </div>
                    <input
                        type="range"
                        value={rotation}
                        min={0}
                        max={360}
                        step={1}
                        aria-labelledby="Rotation"
                        onChange={(e) => setRotation(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all uppercase text-xs tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all uppercase text-xs tracking-widest"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};
