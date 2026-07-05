import socket

s = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
s.connect("/var/ossec/queue/sockets/queue")
s.send(b"1:/var/log/secure:Jan 15 10:00:00 host sshd[1234]: Failed password for invalid user hacker from 192.168.1.99 port 22 ssh2")
print("injected")
