"use client";

import { useState } from "react";

export type ActivityItem = {
  type: "job_found" | "researched";
  text: string;
  time: string;
};

type Props = {
  activities: ActivityItem[];
};

function ActivityDot({ type }: { type: ActivityItem["type"] }) {
  const isJobFound = type === "job_found";
  return (
    <div className="relative shrink-0 flex items-center justify-center w-4 h-4">
      <div
        className={`absolute inset-0 rounded-full ${isJobFound ? "bg-success-light" : "bg-info-light"}`}
      />
      <div
        className={`relative w-2 h-2 rounded-full ${isJobFound ? "bg-success-alt" : "bg-info"}`}
      />
    </div>
  );
}

function ActivityList({
  activities,
  allVisible = false,
}: {
  activities: ActivityItem[];
  allVisible?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {activities.map((item, i) => {
        const isLast = i === activities.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <ActivityDot type={item.type} />
              {!isLast && (
                <div
                  className="w-px flex-1 my-1 bg-border"
                  style={{ minHeight: allVisible ? "16px" : "24px" }}
                />
              )}
            </div>
            <div className={`min-w-0 ${isLast ? "pb-0" : allVisible ? "pb-3" : "pb-4"}`}>
              <p className="text-sm font-medium text-text-primary leading-snug">
                {item.text}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{item.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecentActivity({ activities }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const visible = activities.slice(0, 4);

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">
            Recent Activity
          </h2>
          {activities.length > 4 && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs text-text-muted hover:text-accent transition-colors"
            >
              View all
            </button>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <p className="text-sm font-medium text-text-primary">No activity yet</p>
            <p className="text-xs text-text-muted text-center">
              Run a job search to see activity here.
            </p>
          </div>
        ) : (
          <ActivityList activities={visible} />
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-surface border border-border rounded-2xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-base font-semibold text-text-primary">All Activity</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <ActivityList activities={activities} allVisible />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
