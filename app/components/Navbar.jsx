import React from "react";

export default function Navbar () {
    return (
        <div className="fixed top-0 left-0 w-full z-50">
            <div className="navbar bg-base-100 shadow-sm">
                <div className="flex-1">
                    <a className="btn btn-ghost text-xl">Gig Proof</a>
                </div>
                <div className="flex-none">
                    <ul className="menu menu-horizontal px-1">
                    <li><a>Link</a></li>
                    <li>
                        <details>
                        <summary>Parent</summary>
                        <ul className="bg-base-100 rounded-t-none p-2">
                            <li><a>Link 1</a></li>
                            <li><a>Link 2</a></li>
                        </ul>
                        </details>
                    </li>
                    </ul>
                </div>
                </div>
        </div>
    )
}