import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.prod" });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const emailDomain = 'scienceclublss.me';
const defaultPassword = 'foo';

if (!supabaseUrl || !serviceRoleKey ) {
    throw new Error("Missing required environment variables in .env.prod");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

type RegistryRow = {
    id: number;
    first_name: string | null;
    last_name: string | null;
    other_name: string | null;
    coder: boolean | null;
    has_account: boolean | null;
    email: string | null;
    class: string | null;
    stream: string | null;
};

function cleanNamePart(value: string | null): string | null {
    if (!value) return null;

    const cleaned = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    return cleaned.length > 0 ? cleaned : null;
}

function createEmailFromName(row: RegistryRow): string {
    const nameParts = [
        cleanNamePart(row.first_name),
        cleanNamePart(row.last_name),
        cleanNamePart(row.other_name),
    ].filter(Boolean);

    if (nameParts.length === 0) {
        throw new Error(`Registry row ${row.id} has no usable name fields`);
    }

    return `${nameParts.join("")}@${emailDomain}`;
}

async function getAllAuthEmails(): Promise<Set<string>> {
    const emails = new Set<string>();
    let page = 1;
    const perPage = 1000;

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) {
            throw new Error(`Failed to list Auth users: ${error.message}`);
        }

        for (const user of data.users) {
            if (user.email) {
                emails.add(user.email.toLowerCase());
            }
        }

        if (data.users.length < perPage) break;
        page++;
    }

    return emails;
}

async function createUsersFromRegistry() {
    const existingAuthEmails = await getAllAuthEmails();

    const { data: rows, error: fetchError } = await supabaseAdmin
        .from("registry")
        .select(
            "id, first_name, last_name, other_name, coder, has_account, email, class, stream",
        )
        .eq("has_account", false)
        .order("id", { ascending: true });

    if (fetchError) {
        throw new Error(`Failed to fetch registry rows: ${fetchError.message}`);
    }

    if (!rows || rows.length === 0) {
        console.log("No registry rows without accounts found.");
        return;
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows as RegistryRow[]) {
        try {
            const email = createEmailFromName(row).toLowerCase();

            if (existingAuthEmails.has(email)) {
                console.log(
                    `Skipped row ${row.id}: ${email} already exists in Auth.`,
                );
                skipped++;
                continue;
            }

            const { data: createdUser, error: createError } =
                await supabaseAdmin.auth.admin.createUser({
                    email,
                    password: defaultPassword,
                    email_confirm: false,
    
                });

            if (createError) {
                console.error(
                    `Failed to create ${email}: ${createError.message}`,
                );
                skipped++;
                continue;
            }

            const { error: updateError } = await supabaseAdmin
                .from("registry")
                .update({
                    email,
                    has_account: true,
                })
                .eq("id", row.id);

            if (updateError) {
                console.error(
                    `Created Auth user ${email}, but failed to update registry row ${row.id}: ${updateError.message}`,
                );
                skipped++;
                continue;
            }

            existingAuthEmails.add(email);

            console.log(
                `Created ${email} | Auth ID: ${createdUser.user.id} | Registry row: ${row.id}`,
            );

            created++;
        } catch (error) {
            console.error(
                `Failed row ${row.id}:`,
                error instanceof Error ? error.message : error,
            );
            skipped++;
        }
    }

    console.log(`Done. Created: ${created}. Skipped: ${skipped}.`);
}

createUsersFromRegistry().catch((error) => {
    console.error(error);
    process.exit(1);
});
