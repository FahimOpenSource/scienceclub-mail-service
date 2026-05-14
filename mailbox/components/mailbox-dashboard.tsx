"use client"

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, AlertTriangle, Star, Clock, FlaskConical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";
import { MessageRow } from "@/components/message-row";
import type { EmailMessage } from "@/app/page";

export default function Mailbox({
    allMailStatus,
    spamStatus,
    unreadAllMailStatus,
    unreadSpamStatus,
    allMail,
    error,
}: {
    allMailStatus: number;
    spamStatus: number;
    unreadAllMailStatus: number;
    unreadSpamStatus: number;
    allMail: EmailMessage[];
    error: { message: string };
}) {
    // const [allMailStatus, setAllMailStatus] = useState(0);
    // const [spamStatus, setSpamStatus] = useState(0);
    // const [unreadAllMailStatus, setUnreadAllMailStatus] = useState(0);
    // const [unreadSpamStatus, setUnreadSpamStatus] = useState(0);
    // return <MailboxDashboard />;
    const router = useRouter();
    async function handleSignOut(e: MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();

        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace("/auth");
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
                            <h1 className="text-xl font-semibold">
                                Science Club Mailbox
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Manage your emails
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
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <AlertTriangle className="h-10 w-10 mb-3" />
                                        <p className="text-sm">Comming soon!</p>
                                    </div>
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
