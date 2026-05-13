"use client"

import type { MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, AlertTriangle, Star, Clock, FlaskConical } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { allMailData, spamData, type Email } from "@/lib/emails"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

function EmailRow({ email }: { email: Email }) {
  return (
    <Link
      href={`/mail/${email.id}`}
      className={`flex items-start gap-3 p-4 border-b border-border hover:bg-muted/60 transition-colors ${
        !email.read ? "bg-primary/5" : ""
      }`}
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
          {email.sender
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${!email.read ? "font-semibold" : "font-medium"}`}>
            {email.sender}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {email.starred && <Star className="h-4 w-4 text-accent fill-accent" />}
            <span className="text-xs text-muted-foreground">{email.date}</span>
          </div>
        </div>
        <p className={`text-sm truncate ${!email.read ? "font-medium" : "text-muted-foreground"}`}>
          {email.subject}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</p>
      </div>
    </Link>
  )
}

export function MailboxDashboard() {
  const router = useRouter()
  const unreadAllMail = allMailData.filter((e) => !e.read).length
  const unreadSpam = spamData.filter((e) => !e.read).length

  async function handleSignOut(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()

    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace("/auth")
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Science Club Mailbox</h1>
              <p className="text-sm text-muted-foreground">Manage your emails</p>
            </div>
          </div>
          <a
            href="/"
            onClick={handleSignOut}
            className="mt-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Sign out
          </a>
        </div>

        <Card>
          <Tabs defaultValue="all" className="w-full">
            <div className="border-b border-border px-4 pt-2">
              <TabsList variant="line">
                <TabsTrigger value="all" className="gap-2">
                  <Mail className="h-4 w-4" />
                  All Mail
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {allMailData.length}
                  </Badge>
                  {unreadAllMail > 0 && <Badge className="h-5 px-1.5 text-xs">{unreadAllMail}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="spam" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Spam
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {spamData.length}
                  </Badge>
                  {unreadSpam > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {unreadSpam}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <CardContent className="p-0">
              <TabsContent value="all" className="mt-0">
                <div className="divide-y divide-border">
                  {allMailData.map((email) => (
                    <EmailRow key={email.id} email={email} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="spam" className="mt-0">
                <div className="divide-y divide-border">
                  {spamData.length > 0 ? (
                    spamData.map((email) => <EmailRow key={email.id} email={email} />)
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <AlertTriangle className="h-10 w-10 mb-3" />
                      <p className="text-sm">No spam messages</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Last synced: Just now
          </div>
        </div>
      </div>
    </div>
  )
}
