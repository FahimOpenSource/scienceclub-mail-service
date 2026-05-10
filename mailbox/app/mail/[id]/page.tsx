import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getEmailById } from "@/lib/emails"

export default async function MailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // Simulate a fetch so the loading.tsx UI is visible
  await new Promise((resolve) => setTimeout(resolve, 700))
  const email = getEmailById(id)

  if (!email) {
    notFound()
  }

  const initials = email.sender
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to inbox
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {email.folder === "spam" && (
              <div className="mb-5 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                This message is in Spam. Be careful with its contents.
              </div>
            )}

            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {email.subject}
            </h1>

            <div className="mt-4 flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{email.sender}</span>
                  <span className="text-xs text-muted-foreground">
                    &lt;{email.senderEmail}&gt;
                  </span>
                  {email.folder === "spam" && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      Spam
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  to me &middot; {email.date}
                </p>
              </div>
            </div>

            <Separator className="my-5" />

            <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {email.body}
            </article>
          </CardContent>
        </Card>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Read-only view &middot; replying and forwarding are disabled
        </p>
      </div>
    </div>
  )
}
