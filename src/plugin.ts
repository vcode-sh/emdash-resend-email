import type {
	EmailDeliverEvent,
	PluginContext,
	SandboxedPlugin,
} from "emdash/plugin";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

// RFC 5322 specials: a display name containing one must be a quoted string.
const RFC5322_SPECIALS = /[()<>[\]:;@\\,."]/;

interface ResendError {
	message?: unknown;
	name?: unknown;
}

function formatSender(email: string, name: string | undefined): string {
	if (!name) {
		return email;
	}
	const displayName = RFC5322_SPECIALS.test(name)
		? `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
		: name;
	return `${displayName} <${email}>`;
}

async function readSender(
	ctx: PluginContext
): Promise<{ apiKey: string; from: string }> {
	const [apiKey, fromEmail, fromName] = await Promise.all([
		ctx.settings.get<string>("apiKey"),
		ctx.settings.get<string>("fromEmail"),
		ctx.settings.get<string>("fromName"),
	]);
	if (!(apiKey && fromEmail)) {
		throw new Error(
			"Resend is not configured: add an API key and a sender address in the Resend Email plugin settings."
		);
	}
	return { apiKey, from: formatSender(fromEmail, fromName?.trim()) };
}

async function describeFailure(response: Response): Promise<string> {
	const error: ResendError = await response.json().catch(() => ({}));
	const name = typeof error.name === "string" ? ` ${error.name}` : "";
	const detail =
		typeof error.message === "string" ? error.message : "no error details";
	return `Resend rejected the email (${response.status}${name}): ${detail}`;
}

async function deliver(
	{ message, source }: EmailDeliverEvent,
	ctx: PluginContext
): Promise<void> {
	const { apiKey, from } = await readSender(ctx);
	if (!ctx.http) {
		throw new Error(
			"Resend needs the network:request capability for api.resend.com."
		);
	}

	const response = await ctx.http.fetch(RESEND_EMAILS_URL, {
		body: JSON.stringify({
			cc: message.cc?.length ? message.cc : undefined,
			from,
			html: message.html,
			reply_to: message.replyTo,
			subject: message.subject,
			text: message.text,
			to: message.to,
		}),
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			// Resend answers 403 to requests without a User-Agent.
			"User-Agent": `emdash-resend-email/${ctx.plugin.version}`,
		},
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(await describeFailure(response));
	}

	const { id }: { id?: string } = await response.json();
	ctx.log.info("Email sent through Resend", { id, source });
}

const plugin: SandboxedPlugin = {
	hooks: {
		"email:deliver": { exclusive: true, handler: deliver },
	},
};

export default plugin;
