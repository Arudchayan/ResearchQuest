import os
import glob

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # The issue: "BookOpenIcon" is imported from "@radix-ui/react-icons" instead of "lucide-react"
    # Actually, BookOpen exists in lucide-react. We can just import it as BookOpenIcon.

    if "BookOpenIcon" in content and "@radix-ui/react-icons" in content:
        # replace the import from radix
        content = content.replace("BookOpenIcon,", " ")
        content = content.replace("BookOpenIcon", " ") # just in case

        # We need to make sure BookOpenIcon is imported from lucide-react
        # If it already imports from lucide-react, append BookOpen as BookOpenIcon
        if "from \"lucide-react\"" in content:
            content = content.replace("from \"lucide-react\";", "BookOpen as BookOpenIcon,\n} from \"lucide-react\";")
            content = content.replace("BookOpen as BookOpenIcon,", "BookOpen as BookOpenIcon,") # To avoid duplicates if already there

        with open(filepath, 'w') as f:
            f.write(content)

    # NumberIcon is another issue from radix-ui/react-icons
    if "NumberIcon" in content and "@radix-ui/react-icons" in content:
        content = content.replace("NumberIcon,", " ")
        content = content.replace("NumberIcon", " ")
        if "from \"lucide-react\"" in content:
            content = content.replace("from \"lucide-react\";", "Hash as NumberIcon,\n} from \"lucide-react\";")

        with open(filepath, 'w') as f:
            f.write(content)

for root, _, files in os.walk('researchquest/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
