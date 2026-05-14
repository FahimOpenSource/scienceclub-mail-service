
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Mailbox from "@/components/mailbox-dashboard";

// async function getMessages() {
//   const messages: EmailMessage[] = response;
//   const response = await fetch();
//   const data = await response.json();
//   return data;

// }

export interface EmailMessage {
    id: number;
    gmail_message_id: string;
    gmail_thread_id: string;
    recipient_email: string;
    assigned_user_id: string;
    from_email: string;
    from_name: string;
    subject: string;
    snippet: string;
    received_at: string;
    is_read: boolean;
    created_at: string;
    labelids: string[];
}


async function getMessages(supabase: any) {
  const response = await supabase
    .from("email_messages")
    .select("*", { count: "exact", head: false })
    .order("received_at", { ascending: false });
  if (response.status !== 200) {
    return Promise.reject(
        `Something went wrong while fetching messages: ${response.statusText}`,
    );
  }
  return response.data;
}

async function getNumberOfMessages(supabase: any) {
  const response = await supabase
    .from("email_messages")
    .select("*", { count: "exact", head: true });
  if (response.status !== 200) {
    return Promise.reject(
      `Something went wrong while fetching messages: ${response.statusText}`,
    );
  }
  return {count: response.count};
}


export default async function Page() {
    
    const error: {message:string} = {message:''}
    const supabase = await createSupabaseServerClient();
    const responses = await Promise.all([
      getMessages(supabase),
      getNumberOfMessages(supabase),
    ]).catch(err => {
      return error.message = err
    })
    const user = await supabase.auth.getClaims()
    const owner = user.data ? user.data.claims.email : ''
    // these numbers below depend on what has been sent in allMail if pagination is applied, this may cause inaccurate numbers for spamStatus etc..
    const allMail: EmailMessage[] = responses[0];
    const allMailStatus = responses[1].count
    var spamMail: EmailMessage[] = []
    var unreadAllMailStatus = 0;
    var unreadSpamStatus = 0;
    allMail.forEach(message => {
        if (message.labelids != null) {
             if (message.labelids.includes("SPAM")) {
                 spamMail.push(message);
                 if (!message.is_read) {
                     unreadSpamStatus = unreadSpamStatus + 1;
                 }
             }
        }
        if (!message.is_read) {
            unreadAllMailStatus = unreadAllMailStatus + 1;
        }
           
    });
    const spamStatus = spamMail.length;
    

  return (
    <>
        <Mailbox
            owner={owner ?? ''}
            initAllMailStatus={allMailStatus} 
            initSpamStatus = {spamStatus}
            initUnreadAllMailStatus = {unreadAllMailStatus}
            initUnreadSpamStatus = {unreadSpamStatus}
            initAllMail={allMail}
            initSpamMail={spamMail}
            error = {error}
        ></Mailbox>
    </>
  );
}
