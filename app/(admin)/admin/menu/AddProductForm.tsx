"use client";

import Image from "next/image";
import { useState } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { createProduct } from "./actions";

export default function AddProductForm({ categories }: { categories: any[] }) {
  const [imageUrl, setImageUrl] = useState<string>("");

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-black">Add New Product</h2>

      <form action={createProduct as unknown as (formData: FormData) => void | Promise<void>} className="grid grid-cols-6 gap-4">
        {/* Hidden input to pass the uploaded image URL to the server action */}
        <input type="hidden" name="imageUrl" value={imageUrl} />

        <div className="col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Image
          </label>
          <CldUploadWidget
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
            onSuccess={(result: any) => {
              setImageUrl(result.info.secure_url);
            }}
          >
            {({ open }) => {
              return (
                <div
                  onClick={() => open()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 hover:bg-gray-100"
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt="Uploaded preview"
                      className="h-24 object-contain"
                      width={96}
                      height={96}
                    />
                  ) : (
                    <span className="text-sm text-gray-500">
                      Click to upload an image
                    </span>
                  )}
                </div>
              );
            }}
          </CldUploadWidget>
        </div>

        <div className="col-span-6 sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none text-black"
          />
        </div>

        <div className="col-span-6 sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            name="categoryId"
            required
            className="w-full rounded-md border text-black border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="">Select...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-3 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price (Rs)
          </label>
          <input
            type="number"
            name="basePrice"
            step="0.01"
            required
            className="w-full rounded-md border text-black border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="col-span-3 sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Starting Stock
          </label>
          <input
            type="number"
            name="stock"
            defaultValue="0"
            min="0"
            required
            className="w-full rounded-md border text-black border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="col-span-6 sm:col-span-2 mt-auto">
          <button
            type="submit"
            disabled={categories.length === 0}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            Save Product
          </button>
        </div>
      </form>
    </div>
  );
}
