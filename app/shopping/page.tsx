import { redirect } from "next/navigation";

/** Legacy Shopping route — Acquisitions is the product hub. */
export default function ShoppingRedirectPage() {
  redirect("/acquisitions");
}
