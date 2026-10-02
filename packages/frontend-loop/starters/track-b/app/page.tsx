import { PageView, pageMetadata } from "@/components/PageView";

export const metadata = pageMetadata("index");

export default function Home() {
  return <PageView slug="index" />;
}
