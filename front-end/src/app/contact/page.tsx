import { publicMetadata } from "@/lib/seo";
import { PublicPage } from "@/components/layout/public-page";
import { ContactForm } from "@/components/contact/contact-form";
import "@/styles/account.css";
export const metadata = publicMetadata({
  title: "Contact",
  description:
    "Contact the Clipvelto administrator about your account, videos, credits or a privacy request.",
  path: "/contact",
  image: "/og/contact",
});
export default function ContactPage() {
  return (
    <PublicPage
      title="Contact us"
      intro="Need help with your account, a video or your credits? Send a message to the administrator."
    >
      <ContactForm />
    </PublicPage>
  );
}
