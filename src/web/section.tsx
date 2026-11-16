import { useEffect, useState } from "react";

function newId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 15) | 64;
	bytes[8] = (bytes[8] & 63) | 128;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
type Item = { id: string; name: string; done: boolean };
type Action =
	| { action: "list" }
	| { action: "add"; id: string; name: string }
	| { action: "toggle"; id: string; done: boolean }
	| { action: "delete"; id: string };
async function call(placeId: string, action: Action): Promise<Item[]> {
	const response = await fetch("/api/m/places.want-to-try/items", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ placeId, ...action }),
	});
	if (!response.ok)
		throw new Error("Could not update your list. Please try again.");
	return response.json();
}
export function WantToTrySection({ placeId }: { placeId: string }) {
	const [items, setItems] = useState<Item[] | null>(null);
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState<{ name: string; id: string } | null>(
		null,
	);
	useEffect(() => {
		let current = true;
		setItems(null);
		setError("");
		setName("");
		setPending(null);
		call(placeId, { action: "list" })
			.then((value) => {
				if (current) setItems(value);
			})
			.catch(() => {
				if (current)
					setError("Could not load your list. Please reload the page.");
			});
		return () => {
			current = false;
		};
	}, [placeId]);
	async function mutate(action: Action) {
		setBusy(true);
		setError("");
		try {
			setItems(await call(placeId, action));
			if (action.action === "add") {
				setName("");
				setPending(null);
			}
		} catch {
			setError("Could not update your list. Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<section className="wtt" aria-label="Want to Try">
			<style>{`.wtt{border-top:1px solid color-mix(in srgb,currentColor 18%,transparent);padding-top:24px;display:grid;gap:12px}.wtt h2{font-size:1.2rem;font-weight:600}.wtt p{margin:0}.wtt ul{list-style:none;padding:0;margin:0}.wtt li,.wtt form{display:flex;align-items:center;gap:10px}.wtt li{padding:6px 0}.wtt li label{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow-wrap:anywhere}.wtt input[type=text]{flex:1;min-width:0}.wtt input[type=text],.wtt button{min-height:44px;padding:8px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:5px;background:transparent;color:inherit}.wtt button{cursor:pointer}.wtt input[type=checkbox]{width:20px;height:20px}.wtt .done{text-decoration:line-through;opacity:.65}.wtt small{opacity:.7}.wtt [role=alert]{color:#c65b45}`}</style>
			<h2>Want to Try</h2>
			<small>Only you can see your list.</small>
			{error && <p role="alert">{error}</p>}
			{!items && !error && <p role="status">Loading your list…</p>}
			{items && (
				<>
					<ul>
						{items.map((item) => (
							<li key={item.id}>
								<label className={item.done ? "done" : ""}>
									<input
										type="checkbox"
										checked={item.done}
										disabled={busy}
										onChange={(event) =>
											void mutate({
												action: "toggle",
												id: item.id,
												done: event.target.checked,
											})
										}
									/>
									<span>{item.name}</span>
								</label>
								<button
									type="button"
									aria-label={`Delete ${item.name}`}
									disabled={busy}
									onClick={() => void mutate({ action: "delete", id: item.id })}
								>
									Delete
								</button>
							</li>
						))}
					</ul>
					{items.length === 0 && <p>Save something you want to try here.</p>}
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (name.trim()) {
								const value = name.trim();
								const id = pending?.name === value ? pending.id : newId();
								setPending({ name: value, id });
								void mutate({ action: "add", id, name: value });
							}
						}}
					>
						<input
							type="text"
							aria-label="Something to try"
							placeholder="Something to try"
							value={name}
							maxLength={200}
							disabled={busy}
							onChange={(event) => setName(event.target.value)}
						/>
						<button type="submit" disabled={busy || !name.trim()}>
							Add
						</button>
					</form>
				</>
			)}
		</section>
	);
}
