import { AlertForm } from "@/components/alert-form";

export default async function Alerts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <div className="form-page alerts-page">
    <p className="eyebrow">Personalized radar</p>
    <h1>Let the right events find you.</h1>
    <p className="page-intro">Get one focused weekly email based on your career areas, event types, and companies you care about.</p>
    {query.confirmed === "1" && <div className="success-banner">Your alerts are confirmed.</div>}
    {query.unsubscribed === "1" && <div className="success-banner">You’ve been unsubscribed.</div>}
    <AlertForm defaultCompany={typeof query.company === "string" ? query.company : ""} />
  </div>;
}
