import Server from "next/server";

export const POST = async (req: Request) => {
    const body = await req.json();
    return Server.NextResponse.json(body);
};
