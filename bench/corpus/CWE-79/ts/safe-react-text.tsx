import React from "react";
export function Comment({ body }: { body: string }) {
  return <div className="comment">{body}</div>;
}
