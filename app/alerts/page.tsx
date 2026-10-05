import Link from "next/link";
import { AlertForm } from "@/components/alert-form";

export default async function Alerts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <div className="form-page alerts-page">
    <p className="eyebrow">Personalized radar</p>
    <h1>Let the right events find you.</h1>
    <p className="page-intro">Get one focused weekly email based on your career areas, event types, and companies you care about.</p>
    {query.confirmed === "1" && <div className="success-banner">Your alerts are confirmed.</div>}
    {query.unsubscribed === "1" && <div className="success-banner">You’ve been unsubscribed.</div>}
    {query.invalid === "1" && <p className="form-error" role="alert">This confirmation link is invalid. Please request a new one.</p>}
    {process.env.DATABASE_URL && process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL
      ? <AlertForm defaultCompany={typeof query.company === "string" ? query.company : ""} defaultArea={typeof query.area === "string" ? query.area : ""} />
      : <div className="alert-form"><h2>Email alerts are not available yet.</h2><p>You can receive matching public events in your calendar instead, or save a default view on this device.</p><Link className="primary-wide" href={typeof query.area === "string" ? "/calendar?area=" + encodeURIComponent(query.area) : "/calendar"}>Set up calendar updates</Link></div>}
  </div>;
}
