import { Globe2, ScanSearch, ShieldCheck } from "lucide-react";
import { SubmitForm } from "@/components/submit-form";
export default function SubmitPage() {
  return (
    <div className="submit-page">
      <div className="submit-copy">
        <p className="eyebrow">Help the Cornell community</p>
        <h1>
          Spotted something
          <br />
          we missed?
        </h1>
        <p>
          Paste a public event page. We’ll extract the details, check for
          duplicates, and queue it for review.
        </p>
        <div className="trust-list">
          <span>
            <Globe2 /> Public sources only
          </span>
          <span>
            <ScanSearch /> Structured extraction
          </span>
          <span>
            <ShieldCheck /> Review-ready workflow
          </span>
        </div>
      </div>
      <SubmitForm />
    </div>
  );
}
