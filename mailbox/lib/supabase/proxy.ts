import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet, headers) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value),
                    ); // updating request cookies so that session is in sync for server side code.
                    supabaseResponse = NextResponse.next({
                        request,
                    }); // updating response cookies so that session is in sync for the browser side code.
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options),
                    );
                    Object.entries(headers).forEach(([key, value]) =>
                        supabaseResponse.headers.set(key, value),
                    );
                },
            },
        },
    );

    const { data } = await supabase.auth.getClaims();

    if (
        !data &&
        !request.nextUrl.pathname.startsWith("/auth")
    ) {
        console.log(data)
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone();
        url.pathname = "/auth";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
