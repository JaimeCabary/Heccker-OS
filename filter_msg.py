def fix_message(message):
    lines = message.split(b'\n')
    filtered = [line for line in lines if b"Co-Authored-By: Claude" not in line and b"Co-authored-by: Claude" not in line]
    return b'\n'.join(filtered)
