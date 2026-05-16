"use client"

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, AlertTriangle, Star, Clock, FlaskConical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { MessageRow } from "@/components/message-row";
import type { EmailMessage } from "@/app/page";

export default function Mailbox({
    owner,
    initAllMailStatus,
    initSpamStatus,
    initUnreadAllMailStatus,
    initUnreadSpamStatus,
    initAllMail,
    initSpamMail,
    error,
}: {
    owner: string;
    initAllMailStatus: number;
    initSpamStatus: number;
    initUnreadAllMailStatus: number;
    initUnreadSpamStatus: number;
    initAllMail: EmailMessage[];
    initSpamMail: EmailMessage[];
    error: { message: string };
}) {
    const [allMail, setAllMail] = useState(initAllMail);
    const [spamMail, setSpamMail] = useState(initSpamMail);
    const [allMailStatus, setAllMailStatus] = useState(initAllMailStatus)
    const [spamStatus, setSpamStatus] = useState(initSpamStatus)
    const [unreadAllMailStatus, setUnreadMailStatus] = useState(initUnreadAllMailStatus)
    const [unreadSpamStatus, setUnreadSpamStatus] = useState(initUnreadSpamStatus)
    const router = useRouter();
    async function handleSignOut(e: MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();

        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace("/auth");
    }

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        function updateMail(payload: any) {
          console.log(payload)
          const message:EmailMessage = payload.new
          setAllMail([message, ...allMail])
          setAllMailStatus(allMailStatus + 1);
          if (!message.is_read) {
            setUnreadMailStatus(unreadAllMailStatus+1)
            
          }
          if (message.labelids !== null) {
            if (message.labelids.includes("SPAM")) {
                setSpamMail([message, ...spamMail]);
                setSpamStatus(spamStatus + 1);
                if (!message.is_read) {
                    setUnreadSpamStatus(unreadSpamStatus + 1);
                }
            }
          }
              
        }
        const messageChannel = supabase
            .channel("email-messages-changes")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "email_messages",
                },
                (payload) => updateMail(payload),
            )
            .subscribe();
        return () => {
            supabase.removeChannel(messageChannel);
        };
    });

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                            <FlaskConical className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">
                                Science Club Mailbox
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {owner}
                            </p>
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
                                    <Badge
                                        variant="secondary"
                                        className="ml-1 h-5 px-1.5 text-xs"
                                    >
                                        {allMailStatus}
                                    </Badge>
                                    {unreadAllMailStatus > 0 && (
                                        <Badge className="h-5 px-1.5 text-xs">
                                            {unreadAllMailStatus}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="spam" className="gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Spam
                                    <Badge
                                        variant="secondary"
                                        className="ml-1 h-5 px-1.5 text-xs"
                                    >
                                        {spamStatus}
                                    </Badge>
                                    {unreadSpamStatus > 0 && (
                                        <Badge
                                            variant="destructive"
                                            className="h-5 px-1.5 text-xs"
                                        >
                                            {unreadSpamStatus}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <CardContent className="p-0">
                            <TabsContent value="all" className="mt-0">
                                {unreadAllMailStatus === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <AlertTriangle className="h-10 w-10 mb-3" />
                                        <p className="text-sm">
                                            No messages yet!
                                        </p>
                                    </div>
                                )}
                                <div className="divide-y divide-border">
                                    {allMail.map((email) => (
                                        <MessageRow
                                            key={email.id}
                                            email={email}
                                        />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="spam" className="mt-0">
                                <div className="divide-y divide-border">
                                    {unreadSpamStatus === 0 && (
                                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                            <AlertTriangle className="h-10 w-10 mb-3" />
                                            <p className="text-sm">
                                                No spam here!
                                            </p>
                                        </div>
                                    )}
                                    {spamMail.map((email) => (
                                        <MessageRow
                                            key={email.id}
                                            email={email}
                                        />
                                    ))}
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
    );
}
