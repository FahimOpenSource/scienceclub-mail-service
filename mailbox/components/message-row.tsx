import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Paperclip, Star } from "lucide-react";
import type { EmailMessage } from "@/app/page";


export function MessageRow({ email }: { email: EmailMessage }) {
  const receivedAt = formatDistanceToNow(new Date(email.received_at), {
      addSuffix: true,
  });

  return (
      <Link
          href={`/message/${email.id}`}
          className={`flex items-start gap-3 p-4 border-b border-border hover:bg-muted/60 transition-colors ${
              !email.is_read ? "bg-primary/5" : ""
          }`}
      >
          <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
                  {email.from_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
              </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                  <span
                      className={`text-sm truncate ${!email.is_read ? "font-semibold" : "font-medium"}`}
                  >
                      {email.from_name.split(' ')[0]}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                      {email.labelids !== null && email.labelids.includes("IMPORTANT") && (
                          <Star className="h-4 w-4 text-accent fill-accent" />
                      )}
                      {email.has_attachments && (
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                          {receivedAt}
                      </span>
                  </div>
              </div>
              <p
                  className={`text-sm truncate ${!email.is_read ? "font-medium" : "text-muted-foreground"}`}
              >
                  {email.subject}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {email.snippet}
              </p>
          </div>
      </Link>
  );
}
