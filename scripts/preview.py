from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = ArgumentParser(description="Serve the Dangolf development preview.")
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    options = parser.parse_args()
    public = Path(__file__).resolve().parents[1] / "public"
    handler = partial(PreviewHandler, directory=public)

    with ThreadingHTTPServer((options.bind, options.port), handler) as server:
        print(f"Playing at http://{options.bind}:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
