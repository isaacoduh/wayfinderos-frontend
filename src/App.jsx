import React, { useState } from "react";

const API_URL = import.meta.env.VITE_BACKEND_URL

export default function App() {
    const [query, setQuery] = useState("")
    const [answer, setAnswer] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function submit(e) {
        e.preventDefault();
        setLoading(true);
        setError("")
        setAnswer("");

        try {
            const res = await fetch(`${API_URL}/travel-query`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({query})
            })

            if (!res.ok) throw new Error("Request failed");
            const data = await res.json();
            setAnswer(data.answer)
        } catch (error) {
            setError("Something went wrong. Please try again")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="page">
            <section className="panel">
                <p className="version">Wayfinder OS -0.000001</p>
                <h1>Ask a travel question</h1>

                <form onSubmit={submit}>
                    <textarea 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Plan a 3-day food-focused trip to Lisbon under $900..."
                    />

                    <button disabled={loading || !query.trim()}>
                        {loading ? "Planning...": "Ask Wayfinder"}
                    </button>
                </form>

                {error && <p className="error">{error}</p>}
                {answer && <pre className="answer">{answer}</pre>}
            </section>
        </main>
    )
}