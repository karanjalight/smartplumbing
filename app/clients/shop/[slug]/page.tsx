import { notFound } from "next/navigation";

import { ClientProductDetailView } from "@/components/client/client-product-detail-view";
import { getProductBySlug } from "@/lib/shop-catalog";

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ClientsShopProductPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ClientProductDetailView product={product} />;
}
