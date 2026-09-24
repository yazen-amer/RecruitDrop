"use client";
import { Bookmark } from "lucide-react";
import { useSaved } from "./saved-provider";
export function SaveButton({ id }: { id: string }) {
  const { saved, toggle } = useSaved();
  const active = saved.includes(id);
  return (
    <button className="secondary-wide" onClick={() => toggle(id)}>
      <Bookmark size={16} fill={active ? "currentColor" : "none"} />
      {active ? "Saved to your list" : "Save event"}
    </button>
  );
}
