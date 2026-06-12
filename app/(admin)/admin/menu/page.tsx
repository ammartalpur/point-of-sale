import {
  getCategories,
  getProducts,
  createCategory,
  deleteCategory,
  updateProductStock,
} from "./actions";
import AddProductForm from "./AddProductForm";
import ProductImageCell from "./ProductImageCell"; // <-- Interactive image cell imported

export default async function MenuManagementPage() {
  const categories = await getCategories();
  const products = await getProducts();

  return (
    <div className="p-8 max-w-7xl mx-auto ">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          Menu & Inventory Management
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* --- LEFT COLUMN: CATEGORIES --- */}
        <div className="col-span-1 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-black">Add Category</h2>
            <form
              action={async (formData: FormData) => {
                "use server";
                await createCategory(formData);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                name="name"
                placeholder="e.g., Fast Food..."
                required
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
              />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </form>

            <div className="mt-6 space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm border border-gray-100"
                >
                  <span className="font-medium text-gray-700">{cat.name}</span>
                  <form
                    action={async () => {
                      "use server";
                      await deleteCategory(cat.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-gray-500 italic text-center py-2">
                  No categories yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: PRODUCTS & INVENTORY --- */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Cloudinary-enabled Client Component Form for NEW products */}
          <AddProductForm categories={categories} />

          {/* Interactive Inventory Table for EXISTING products */}
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Adjust
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          {/* NEW: Interactive Clickable Image Cell */}
                          <ProductImageCell
                            productId={product.id}
                            currentImage={product.imageUrl}
                          />

                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.category.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Rs {Number(product.basePrice).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            product.stock > 10
                              ? "bg-green-50 text-green-700 border-green-200"
                              : product.stock > 0
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {product.stock} in stock
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <form
                          action={async (formData: FormData) => {
                            "use server";
                            await updateProductStock(formData);

                          }}
                          className="flex items-center justify-end gap-2"
                        >
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <input
                            type="number"
                            name="newStock"
                            defaultValue={product.stock}
                            min="0"
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-white border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Update
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-sm text-gray-500 italic bg-gray-50"
                      >
                        No products in inventory yet. Add a category and create
                        your first product above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
