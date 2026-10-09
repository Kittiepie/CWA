CWA HTTP3 Server
================

This is a simple HTTP3 server that uses WebTransport to send datagrams to a client.

# Installation

`TODO`

# Configuration

## TLS 

Due to the fact that, currently, TLS must be terminated by `@fails-components/webtransport`, the server must handle TLS by itself. Note that the certificates used in the setup must satisfy the [WebTransport Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport/WebTransport):

```
The certificate must be an X.509v3 certificate with a validity period of less than 2 weeks, and the current time must be within that validity period. The format of the public key in the certificate depends on the implementation, but must minimally include ECDSA with the secp256r1 (NIST P-256) named group, and must not include RSA keys. An ECSDA key is, therefore, an interoperable default public key format. A user agent may add further requirements; these will be listed in the browser compatibility section if known.
```

There are two ways to do this.

### 1. Certificate Pinning

**This method is for development environment only, you won't be able to deploy the app using Docker with it**. To generate a certificate with that satisfy those requirements, use the following commands:

```sh
# Generate an ECDSA P-256 private key.
openssl ecparam -name prime256v1 -genkey -noout -out key.pem

# Generate an X.509v3 self-signed certificate, valid for 13 days.
openssl req -new -x509 \
  -key key.pem \
  -out cert.pem \
  -sha256 \
  -days 13 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=serverAuth"
```

Then specify the paths to the certificate and key in the `HTTP3/.env` file:

```.env
HTTP3_CERT_FILE_PATH=
HTTP3_KEY_FILE_PATH=
```

> NOTE: The example env provided in the repository is configured to use the certificates in the `HTTP3/certs` directory.
> If you ran the commands to generate the certificate and key directly in the `HTTP3` directory, then the variables should instead be:
> 
> ```.env
> HTTP3_CERT_FILE_PATH=./cert.pem
> HTTP3_KEY_FILE_PATH=./key.pem
> ```

Use this command to generate the certificate hash:

```sh
openssl x509 -in cert.pem -outform DER |
  openssl dgst -sha256 -binary |
  base64 -w 0
echo
```

Or run the server with once (with `NODE_ENV=development`), which will print the hash to the console.

Finally, pin the hash in the client using an environment variable in `WEB/.env`:

```.env
NEXT_PUBLIC_CERT_HASH=<YOUR HASH HERE>
```

### 2. Use a local CA (Certificate Authority)

The main difference about this method is that, once the CA is trusted by the browser or system, no tampering with the client's source code or environment variables is required. To rotate the certificates, you simply need to recreate another set of `cert.pem` and `key.pem` in the same location.

**This method is also for development environment only, however you can deploy the app using Docker with it**. 

1. Firstly, due to the fact that QUIC requires all certificate chains to be anchored directly to a globally trusted, public root CA (Web PKI) in the Chrome Root Store, Chrome's WebTransport engine deliberately rejects local developer CAs like `mkcert`. To change this, go to `chrome://flags/#webtransport-developer-mode` (enter the url to the browser's search bar) and change the dropdown setting to `Enabled`.
2. Then create a local CA by installing and follow the guide on [https://github.com/FiloSottile/mkcert](https://github.com/FiloSottile/mkcert). Be sure to run `mkcert -install` to install the local CA in your system's and browser's trust store.
3. Finally, run: `mkcert -ecdsa -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 ::1` to generate the certificate and key, similar to the previous method.

> NOTE: Due to how the Dockerfile is configured, certificates must be placed in the `HTTP3/certs` directory for it to be read by the server.
> `cd HTTP3/certs` before running the commands below.

Now set the `HTTP3_CERT_FILE_PATH` and `HTTP3_KEY_FILE_PATH` environment variables to the paths of the generated `cert.pem` and `key.pem` files, then restart the server.

### 3. Use a trusted CA such as Let's Encrypt

`TODO`
