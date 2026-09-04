import { redirect } from "next/navigation";

export default function BasketRedirect() {
  redirect("/crates");
}
