import Link from "next/link";
import { Button } from "@/ui/button";
import { FullPageStatus } from "@/ui/full-page-status";

export default function NotFound() {
  return (
    <FullPageStatus
      description="The page you're looking for doesn't exist or has been moved."
      kicker="404"
      title="Page Not Found"
    >
      <Link href="/">
        <Button variant="default">Go Home</Button>
      </Link>
    </FullPageStatus>
  );
}
