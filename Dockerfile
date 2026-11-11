FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src
COPY assets /usr/share/nginx/html/assets
EXPOSE 80
