package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"html"
	"io"
)

var db *sql.DB


func Status(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("https://status.example.com/api")
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(w, resp.Body)
}
