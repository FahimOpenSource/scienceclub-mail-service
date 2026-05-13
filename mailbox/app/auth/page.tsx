import { AuthForm  } from "@/components/auth-form"
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ClassRow = {
    id: number;
    name: string;
};

type StreamRow = {
    id: number;
    name: string;
};

type ClassStreamRow = {
    id: number;
    class_id: number;
    stream_id: number;
};

async function getClassOptions() {
    const supabase = createSupabaseAdminClient();
    const [{ data: classes }, { data: streams }, { data: classStreams }] =
        await Promise.all([
            supabase.from("classes").select("id, name").order("id"),
            supabase.from("streams").select("id, name").order("id"),
            supabase
                .from("class_streams")
                .select("id, class_id, stream_id")
                .order("id"),
        ]);

    const streamById = new Map(
        ((streams ?? []) as StreamRow[]).map((stream) => [stream.id, stream]),
    );

    return ((classes ?? []) as ClassRow[]).map((klass) => ({
        id: klass.id,
        name: klass.name,
        streams: ((classStreams ?? []) as ClassStreamRow[])
            .filter((classStream) => classStream.class_id === klass.id)
            .map((classStream) => {
                const stream = streamById.get(classStream.stream_id);

                return {
                    classStreamId: classStream.id,
                    name: stream?.name ?? "",
                };
            })
            .filter((stream) => stream.name),
    }));
}



export default async function AuthenticationPage() {
    const classOptions = await getClassOptions();

    return (
        <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
            <AuthForm classOptions={classOptions} />;
        </main>
    ); 
}
