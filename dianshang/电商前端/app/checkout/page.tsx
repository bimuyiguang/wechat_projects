import CheckoutClient from "./checkout-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function CheckoutPage() {
  return <CheckoutClient />
}
