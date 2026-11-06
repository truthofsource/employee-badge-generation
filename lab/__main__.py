import argparse
from .demo import report
from .render import export_example
from .workbench import serve


def main():
    parser = argparse.ArgumentParser(
        description="Employee badge reference: local preview and actual extracted lifecycle rules"
    )
    parser.add_argument("command", choices=["demo", "serve", "render"])
    parser.add_argument("--port", type=int, default=8011)
    parser.add_argument("--out", default=".local/badge-preview")
    args = parser.parse_args()
    if args.command == "serve":
        serve(report, args.port)
    elif args.command == "render":
        export_example(args.out)
        print(
            "Fictional PNG/PDF previews exported. No badge issued and no AI request made."
        )
    else:
        import json

        print(json.dumps(report(), indent=2))


if __name__ == "__main__":
    main()
