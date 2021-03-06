# Use latest node
FROM node:15.7.0-alpine3.12

LABEL repository="https://github.com/fmossott/Roomba980"

# Create runtime user
RUN adduser --uid 2000 -G root --disabled-password --gecos '' roomba

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Set the node env (we only need production dependencies in the deployed image)
ENV NODE_ENV production

# Install dependencies (we deliberately just copy packages.json so we can use the cache if no package.json changes are made)
COPY package.json /usr/src/app/
RUN npm install

# Copy the sources
COPY . /usr/src/app
RUN chown -R roomba /usr/src/app/missions

# Set default env
ENV BLID=
ENV PASSWORD=
ENV ROBOT_IP=
ENV FIRMWARE_VERSION=
ENV ENABLE_LOCAL=
ENV ENABLE_CLOUD=
ENV KEEP_ALIVE=
ENV SSL_KEY_FILE=
ENV SSL_CERT_FILE=
ENV PORT=3000
ENV ROOT_PATH=

EXPOSE ${PORT}

USER roomba

# Start the REST interface!
CMD [ "npm", "start" ]
