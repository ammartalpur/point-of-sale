"use client";

import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";
import { updateProductImage } from "./actions";
import { useState } from "react";

export default function ProductImageCell({
  productId,
  currentImage,
}: {
  productId: string;
  currentImage?: string | null;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <CldUploadWidget
      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
      onSuccess={async (result: any) => {
        setIsUpdating(true);
        // Call the server action to save the new image to the database
        await updateProductImage(productId, result.info.secure_url);
        setIsUpdating(false);
      }}
    >
      {({ open }) => (
        <div
          onClick={() => open()}
          className={`relative h-12 w-12 shrink-0 rounded-md bg-gray-100 overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all ${isUpdating ? "animate-pulse opacity-50" : ""}`}
          title="Click to update image"
        >
          {currentImage ? (
            <Image
              src={currentImage}
              alt="Product"
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <svg
                className="w-5 h-5 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              <span className="text-[9px] font-medium leading-none">
                Add Img
              </span>
            </div>
          )}
        </div>
      )}
    </CldUploadWidget>
  );
}
