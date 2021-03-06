package jwt

/*
	This JWT implementation does't math (RFC 7519).
	Support only one hash function HMAC-SHA512, and not support any claims, except Expiration Time field.

	Actually, this is not JWT, but i use ideas from JWT.
*/

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

// Header information in JWT
type Header struct {
	Aig string
}

// Payload information in JWT about user
type Payload struct {
	UUID      string
	IsAdmin   bool `json:"is_admin"`
	Roles     []Role
	AuthRooms []AuthRoom `json:"auth_rooms"`
	Exp       int64
}

// Role describes information about where user is owner and what is him Permissions
type Role struct {
	UUID  string `json:"room_uuid"`
	Level int
}

// AuthRoom is a list where user authorized
type AuthRoom struct {
	UUID   string `json:"uuid"`
	Passwd string `json:"passwd"`
}

// Required length in bytes of a HMAC-512SHA key
const requiredKeySize = 64

var (
	// ErrKeyLength return when specified key not equal 512 bit, or 64 bytes
	ErrKeyLength = errors.New("Length of the specified key not equal 512 bits, or 64 bytes")

	// ErrCorruptedToken return when specified JWT in user request does't have one or more requered parts of JWT
	// JWT must contain header, payload and signature separated by dot
	ErrCorruptedToken = errors.New("Your JWT is corrupted and/or does't match the required")

	// ErrTokenExpired return when token has expired
	ErrTokenExpired = errors.New("Your token has expired")
)

// GenerateNewToken generate and return new JWT
func GenerateNewToken(header Header, payload *Payload, key string) (string, error) {
	if utf8.RuneCountInString(key) != requiredKeySize {
		return "", ErrKeyLength
	}

	headerBytes, _ := json.Marshal(header)
	payloadBytes, _ := json.Marshal(payload)

	hEnc := base64.URLEncoding.EncodeToString(headerBytes)
	pEnc := base64.URLEncoding.EncodeToString(payloadBytes)
	sign := calcHash(key, fmt.Sprintf("%s.%s", hEnc, pEnc))

	return fmt.Sprintf("%s.%s.%s", hEnc, pEnc, sign), nil
}

// ValidateToken check validity of the JWT
func ValidateToken(jwt, key string) (bool, error) {
	if len(key) != requiredKeySize {
		return false, ErrKeyLength
	}
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return false, ErrCorruptedToken
	}

	hDec := parts[0]
	pDec := parts[1]
	sign := parts[2]

	if calcHash(key, fmt.Sprintf("%s.%s", hDec, pDec)) != sign {
		return false, nil
	}

	var payload Payload

	pEnc, _ := base64.URLEncoding.DecodeString(pDec)

	err := json.Unmarshal(pEnc, &payload)
	if err != nil {
		return false, ErrCorruptedToken
	}

	tNow := time.Now().UnixNano()
	if tNow >= payload.Exp {
		return false, ErrTokenExpired
	}

	return true, nil
}

// UnmarshalPayload unmarshal payload from token and return it
func UnmarshalPayload(token string) (*Payload, error) {
	if token == "" {
		return nil, ErrCorruptedToken
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrCorruptedToken
	}

	pDec := parts[1]
	pEnc, err := base64.URLEncoding.DecodeString(pDec)
	if err != nil {
		return nil, err
	}

	var payload Payload

	err = json.Unmarshal([]byte(pEnc), &payload)
	return &payload, err
}

func calcHash(key string, value string) string {
	h := hmac.New(sha512.New, []byte(key))
	h.Write([]byte(value))

	return hex.EncodeToString(h.Sum(nil))
}

// GetLevel return permissions level for a room
func (p Payload) GetLevel(uuid string) (int, bool) {
	for _, r := range p.Roles {
		if r.UUID == uuid {
			return r.Level, true
		}
	}

	return 0, false
}

// SetLevel set up new permissions level for a room
func (p *Payload) SetLevel(uuid string, level int) {
	if _, r := p.GetLevel(uuid); !r {
		p.Roles = append(p.Roles, Role{
			UUID:  uuid,
			Level: level,
		})
		return
	}

	for i, r := range p.Roles {
		if r.UUID == uuid {
			p.Roles[i].Level = level
		}
	}
}

// CheckAuthStatus check auth status in room
func (p Payload) CheckAuthStatus(uuid string, hash []byte) error {
	for _, r := range p.AuthRooms {
		if r.UUID == uuid {
			passwd, err := hex.DecodeString(r.Passwd)
			if err != nil {
				return errors.New("Couldn't read authorized session for this room")
			}

			if err := bcrypt.CompareHashAndPassword(hash, passwd); err != nil {
				return errors.New("Password invalid")
			}

			return nil
		}
	}

	return errors.New("You're not logged in this room")
}

// SetAuthStatus set up new auth session for a room
func (p *Payload) SetAuthStatus(uuid, passwd string) {
	for i, r := range p.AuthRooms {
		if r.UUID == uuid {
			p.AuthRooms[i].Passwd = passwd
			return
		}
	}

	p.AuthRooms = append(p.AuthRooms, AuthRoom{
		UUID:   uuid,
		Passwd: passwd,
	})
}
