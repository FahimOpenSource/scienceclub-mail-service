import { json } from "node:stream/consumers";

export default {
    async email(message, env, ctx) {
        const rawEmail = await new Response(message.raw).text()
        console.log("222222" + rawEmail);

        await message.forward(env.MASTER_GMAIL);
    },
};
